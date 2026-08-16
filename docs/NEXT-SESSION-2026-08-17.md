# Next session — copy-paste brief (session 16 close-out, 2026-08-16)

**Lane:** in-thread chat · worktree `~/virtuna-in-thread-chat`
**Shipped:** **PR #523, MERGED** — merge commit `cf58a5f0`. The monologue leak's *assembly* half is
closed (N-1 + N-2). The branch `fix/monologue-stream-leak` is deleted.
**Gates, run ON the merged main (`cf58a5f0`), not on the pre-merge tree:**
`tsc` exit 0 / 0 lines · **567 test files passed, 1 skipped · 6562 tests passed, 42 skipped, 0
failed** (`--maxWorkers=3`) · `npm run build` **exit 0**. All three re-run after the merge, because
#524 and #525 landed between the pre-merge gate and the merge itself.

> ⚠️ **`main` is held by the trunk worktree `~/virtuna-v1.1`.** This worktree cannot check it out.
> Branch from `origin/main` directly: `git switch -c <type>/<thing> origin/main`.

---

## ▶️ PASTE THIS TO START

```
Read docs/NEXT-SESSION-2026-08-17.md, then docs/HANDOFF-2026-08-13-audit-rewalk.md §2.

Repo ~/virtuna-in-thread-chat. Session 16 merged PR #523 (cf58a5f0) — the monologue leak's
assembly half. tsc 0 + 6562 tests 0 failed, verified ON the merge commit.

⚠️ main is checked out by the trunk worktree. `git switch -c <type>/<thing> origin/main`.
⚠️ RE-CHECK main BEFORE branching AND before opening a PR: git fetch && git rev-parse origin/main
Main moved twice during session 16 alone (#524, #525 landed mid-session, from co-sessions).

CONTEXT: this is the in-thread chat lane — chat runs the tools. The last week has been
auditing what that surface produces. The F-audit backlog is now TWO rows, not four.

🔴 THE FINDING THAT MATTERS MOST THIS SESSION — read before planning anything:
Four successive briefs listed "F-3, F-8, F-11, F-12 — never measured, one live billed run
each." TWO OF THEM WERE ALREADY FIXED IN CODE, and had been since before the table that
called them unmeasured was written:
  - F-3  fixed by 7d4bc133 (2026-08-10) — three days BEFORE the 08-13 rewalk listed it open
  - F-8a fixed by 53fe7323 (2026-08-11)
Nobody re-checked, because "⚪ unmeasured" reads as "still broken" when it only ever meant
"nobody looked." Those are not the same claim. Cost: a billed live run was budgeted four
times for work already done.
  🔑 ⚪ UNMEASURED ≠ UNFIXED. git log --all --grep before you budget a run against any row.

OPEN, in the order I would take them — ASK first, this lane is at a clean stop:
  1. F-11b — DEAD AIR. Measured free on 2026-08-16 and it is REAL: median 5.28s (prose)
     / 4.04s (skill) before the first character reaches the creator. The transport
     streams fine; there is simply nothing to send yet. This is a FIX task, not a
     measuring task — and it is the largest known defect left on this surface.
  2. F-11d + F-12b — the only things still needing a PAID run. Both need a billable
     generator to actually run: cards to count, and the ProgressChecklist spine to exist.

🔴 IF YOU WRITE A BROWSER PROBE, MAKE IT WAIT. The F-12 probe typed the instant the
textarea appeared and measured a 641px void that matched the audit almost exactly —
screenshot and all. It was the probe's own artefact: the textarea mounts BEFORE thread
history hydrates, so the live turn was stranded at the top of an empty thread. A 3s
settle collapses it to 75px from the FIRST sample. A probe that acts at machine speed
measures a state the product only occupies while loading.
  3. Task #31 — the monologue leak's STREAM half. Owner-deferred, not forgotten.
  4. The sidebar ⋯ menu — a design call, not a CSS one.

🔑 BEFORE BUDGETING A RUN, ASK WHICH HALF OF THE ROW THE MONEY IS FOR. F-11 read as one
indivisible "needs a live billed run" for four briefs. Three of its four parts turned out
to be answerable from code plus a FREE loop probe (omit deps.billing → skills fail closed).

🔴 F-11b IS DECOMPOSED — AND ONE FIX COSTS NOTHING AND TRADES NOTHING. Read §2b before
touching it. The short version: ~2s of the dead air is enable_thinking (a real
quality/latency TRADE, owner's call, do not flip it unilaterally), ~3s is baseline
provider latency — but the mitigation built specifically to FILL this wait already
exists and is DARK. route.ts:484 calls it "the predispatch frame — fills the router's
~4.8s dead zone", and it is gated on NEXT_PUBLIC_ENGINE_ONE_BRAIN, which is `=== "true"`
(default off) and set nowhere.

DO NOT:
  - Do not budget a live run for F-3 or F-8a. Fixed. See rewalk §2.
  - Do not cap a search-and-answer turn's prose. 25 of 34 over-cap turns are those and
    their long prose IS the answer. Pinned by a test.
  - Do not lower RUNAWAY_PROSE_CAP (8,000) to "catch more." It sits in a measured empty
    gap: largest real answer 3,791, smallest leak 18,484. Lowering it starts eating answers.
  - Do not remove the templateInstantiated guard or touch the ~4% proof rate. Both CORRECT.
  - Do not propose reconnecting the deploy. OFF deliberately, owner-confirmed.
  - Do not backfill funnel_events.origin. Do not delete the 9 card pickers (/settings, LIVE).

💰 Do not walk /welcome with a real handle — a ~128s Apify scrape on a $5/mo capped account.

⚠️ The suite flakes NON-DETERMINISTICALLY (two known families). ALWAYS re-run a failure in
isolation and check whether the file can even reach your diff before blaming it.
```

---

## 1. What #523 closed, and what it deliberately did not

**Closed — the answer the creator ends up with.** Three production rows persisted 18,484–33,165
chars of the model's own planning voice as the answer (thread `b13d63f4`, 2026-08-12, one ask asked
four times). `reasoning-leak.ts` drops the three attested tag shapes at assembly and returns
untagged input **byte-identical**, so a healthy answer is never even trimmed. `RUNAWAY_PROSE_CAP`
then bounds the no-card branch, which previously had **no ceiling at all** — `cardsDelivered` is
false for a prose turn, so F-1's budget never governed it.

**Also closed — the anonymous door.** The loop has a single exit and it is a ternary. The strip
reached both halves; the cap reached only `answer`. A sealed `/go` visitor binds no generator
(`FREE_SKILL_TOOLS` is empty), gets `enable_thinking` anyway (`composedCards` is a global
default-ON read with no visitor check), and has `textCap: Infinity`. Measured on the same
36,236-char tagless stream: **bound 0 out, unbound 36,236 out.** Now `chat-agent-loop.ts:1685`.

**NOT closed, by owner ruling — task #31.** It still **streams**; withholding tokens means
buffering. And leaked reasoning still enters `assistantMsg.content` (~`:1221`), costing tokens on
later rounds. If revisited, the pattern is `createProseCallGuard` (`prose-call.ts`).

> ⚠️ **The trigger was never reproduced** — 0 of 21 live runs across four request shapes, including
> the shipped 25,268-char prompt with thread history (`scripts/probe-thinking-content-channel.ts`).
> The first hypothesis (binding tools moves reasoning into content) was refuted 10/10. Production
> leaked 3 of 4 identical asks on 08-12 and 0 of 6 on 08-13. **A clean run is not evidence it is
> gone.** That is why this is a boundary guard, not a prompt change — there is nothing to A/B.

## 2. 🔴 The backlog is TWO rows, not four

Full evidence in `HANDOFF-2026-08-13-audit-rewalk.md` §2, where the rows and the header are now
corrected. In short, verified in code on 2026-08-16:

| row | verdict | why |
|---|---|---|
| **F-3** audience flips to "General" | 🟢 **fixed `7d4bc133`** | `thread-turn.tsx:252` falls back to `'your audience'`, never the literal — the comment names *"(Stage A, F-3)"*. And the chat path *does* resolve an audience before stamping: `chat/route.ts:412` → `:683` |
| **F-8a** static `◐ adjacent` glyph | 🟢 **fixed `53fe7323`** | production hard-codes `fitLabel: null` (`composed-card-receipt.ts:104`, `remix-runner.ts:434`); `proof-receipt.tsx:102` renders no glyph on null. Only *fixtures* still say `"adjacent"` |
| **F-8b** fixed persona roster | ⚪ open-ish | genuinely unmeasured, but **not a hardcode** — `profile-runner.ts:186` derives personas from the bake signature. A repeated roster would mean repeated calibration *input*. Needs a **calibrated** audience or it proves nothing. (`Lurker` occurs nowhere in `src/`) |
| **F-11a** transport does not stream | 🟢 **false** | `event: token` per delta → `use-chat-stream.ts:295` `setStreamingText` per token. Wired since `216df989` (**2026-06-21**), two months before the audit. Proven live in reverse: **#523 exists because leaked reasoning streamed** |
| **F-11b** dead air before first char | 🔴 **STILL LIVE — and it is the whole row** | Measured free, N=4/shape: **prose median 5.28s**, **skill median 4.04s** (dispatching `generate_hooks` 4/4). The audit's ~5.5s is intact. Decomposed below. `scripts/probe-f11-stream-timing.ts` |
| **F-11c** text lands in one paint | 🟢 **false for prose** | 63–104 token frames per answer; median max inter-token gap **0.18s**, worst 0.88s. No silence for a burst to hide behind |
| **F-11d** cards arrive all at once | ⚪ open | `onBlock` fires per block, so incremental is *possible* — but blocks need a billing seam. **Paid run.** Count off the SSE, not the DOM |
| **F-12a** the PROSE wait is in a void | 🟢 **false — measured in a browser** | Gap to composer **75px desktop / 64px mobile**, constant across all 44 samples, and the wait sits **668px / 469px from the viewport TOP** — near the bottom, anchored by the composer. The inverse of the row. `scripts/probe-f12-wait-layout.mjs` |
| **F-12b** the SKILL-RUN wait is in a void | ⚪ open | the row's original sentence. Needs `ProgressChecklist`, which needs `stage` events, which need a **billable** generator. F-12a cannot clear it |

**The trap, stated once so it stops recurring.** `7d4bc133`'s title is *"…F-3/F-7 receipts, F-1
re-answer"*. Session 15 correctly warned nobody should read that title as closing **F-7** — and
that warning is right. But the same commit **did** close **F-3**, and the warning got applied to
the whole title. *Reading one commit as closing nothing is the mirror image of reading it as
closing everything.* Open the diff, not the subject line.

## 2b. 🔴 F-11b decomposed — where the 4–5 seconds actually go

Measured 2026-08-16, free, N=4 per shape per setting (`PROBE_COMPOSING=false` flips the shipped
toggle). Medians, time to the **first character**:

| shape | thinking ON (what ships) | thinking OFF | delta |
|---|---|---|---|
| prose | **5.28s** | **3.14s** | −2.14s |
| skill | **4.04s** | **2.35s** | −1.69s |

**So roughly 2s is `enable_thinking`, and roughly 3s is baseline** — provider time-to-first-token
against a 25,268-char system prompt, which no amount of client work removes.

⚠️ **`composing` is not a clean isolation of thinking.** It is `!!input.composedCards` (`:955`) and
drives **four** things: `enable_thinking` (`:1154`), `max_tokens`, `max_rounds`, and the tool-use
directive. The table above is the *shipped toggle*, which is what a decision would flip — not a
controlled experiment on thinking alone.

🔴 **Do NOT flip `COMPOSED_CARDS` to buy the 2s. It is a TRADE, and it is the owner's call.**
- The comment at `:1137` records the quality side: composing **true** measured 6/6 and 5/6 against
  the shipped contract; **false** measured 2/6, 3/6, 4/6.
- It also changes *behaviour*: with composing off, the plain prose ask "why do most morning routines
  fail" called `generate_ideas` on **2 of 4** runs. It did not dispatch at all with composing on.
  Flipping this buys latency and spends dispatch precision.

✅ **THE PART THAT COSTS NOTHING AND TRADES NOTHING — and it is already built.**
`route.ts:484` is commented *"Stage B (B3): the predispatch frame — **fills the router's ~4.8s dead
zone**"*. That is this exact wait, named and sized by whoever built it. It streams a `predispatch`
frame *before* the loop starts so the thinking dots can label themselves from what is already known
(a chip's declared skill is `certain: true`; a typed ask gets the cheap `guessSkill` heuristic as
`certain: false`).

**It never fires.** It is gated on `ONE_BRAIN` (`:492`), i.e. `NEXT_PUBLIC_ENGINE_ONE_BRAIN ===
"true"` (`:216`) — the dark convention — and the variable is set nowhere, including `.env.local`.

So the wait is not only long, it is *unlabelled*, and the labelling was written and switched off.
That does not shorten the 4–5s; it changes what the creator stares at during it, which is what every
benchmark in the original audit was actually doing differently. ⚠️ `ONE_BRAIN` also gates three
other things (`:360`, `:363`, `:610` — anchor, cards, `cardsSlot`), so turning it on is **not** a
one-line latency patch. Read Stage A/B (#461) before flipping it.

🔎 And the capsule cannot label itself even when the frame does fire: `onDispatch` is at
`chat-agent-loop.ts:1552`, **after** the billing gate at `:1528`, despite its interface comment
(`:322`) claiming *"the moment the agent COMMITS … BEFORE `run`"*.

## 3. 🔴 MEMORY THAT COULD NOT BE SAVED — and the blocker is now precisely characterised

**No memory was written this session either — the fifth in a row.** But the diagnosis is now exact,
and one previously-recorded remedy is confirmed correct while a *new* false positive is recorded:

- The guard is on the **file-write tools** (Edit/Write). Its message: the memory path resolves to
  git root `/Users/davideloreti`, which differs from the active worktree root.
- ✅ Session 15's conclusion **stands**: `cd`-ing to trunk does not help, because trunk's root is
  `~/virtuna-v1.1`, also ≠ `~`. **Only a session whose worktree root is `~` can write these files.**
- 🔴 **NEW — a false positive worth recording.** `touch` on the memory directory from **Bash
  succeeds**, because Bash is not gated by that hook. I briefly concluded from this that the
  blocker was imaginary and four handoffs had been wrong. It is not, and they were not.
  **The instrument that passed was not the instrument that does the write.** Same family as this
  lane's `innerText`/`scrollWidth` false passes — probe with the mechanism you actually intend to
  use. (Writing it via Bash *would* work; that is routing around a guard the harness put there, so
  it needs an explicit owner call, not a workaround.)

**Work order for a session started at `~`:**

**A.** `MEMORY.md:111` still reads *"In-thread chat lane — session 13 MERGED … F-1 still live at
~8%. Read `docs/NEXT-SESSION-2026-08-14.md` first."* All three clauses are wrong: it is session 16,
**F-1 was closed in #514**, and that brief has been superseded twice. Replace with:

> `- [In-thread chat lane — session 16 MERGED (#523)](in-thread-chat-audit-lane.md) — ⚪ unmeasured ≠ unfixed: F-3 + F-8a were fixed in code while four briefs budgeted live runs for them. The ~4% proof rate is a CORRECT guard. Read docs/NEXT-SESSION-2026-08-17.md first.`

**B.** `in-thread-chat-audit-lane.md` — four stale claims:
1. Frontmatter + body say **session 13**; it is 16.
2. Lines 13–14 say the file *"can only be corrected from trunk"* — trunk does not satisfy the guard
   either. Only `~` does.
3. *"Biggest thing still broken: `exemplars-get-copied-verbatim`"* — **#482 fixed it 2026-08-12,
   43% → 0%.** Session 14's brief already flagged this bullet as having cost a session; it is still
   there.
4. *"F-1 is still live at ~8%"* (lines 59–61) — **closed in #514.**

**C.** A new memory worth having:

> **⚪ unmeasured ≠ unfixed.** An audit row marked "never measured" records that *nobody looked* —
> not that the defect survives. F-3 and F-8a sat in that column across four briefs and one budgeted
> live run while both had already been fixed in code, one of them three days before the table was
> written. The tell: a status column that only ever gets updated when someone *measures* can never
> record a fix that landed **from another lane**. `git log --all --grep` before budgeting against
> any inherited row.

## 4. Known-good — do not re-litigate

- The 25 search→prose turns are correct behaviour and are pinned by a test.
- `RUNAWAY_PROSE_CAP = 8,000` is **not** the prose cap this lane forbids. Biting the search-and-answer
  turns would need it near 600; a test pins a 4,278-char answer passing through untouched.
- The ~4% proof rate is a correct guard stripping citations the model did not earn.
- `checkout_open` is not an unreachable event; its zero is real.
- The 9 card pickers are LIVE on `/settings`.
- F-1 and F-7 are closed (#514) — verified again in code this session:
  `createSourceDiversityCap()` is called by **both** runners (`hooks-runner.ts:790`,
  `ideas-runner.ts:725`) and pinned by `source-diversity.test.ts`.

## 5. Loose ends, unchanged and deliberately not taken

- `deriveSeedPrompts` (`lib/chat/seed-prompts.ts`) — orphaned since `CommandBar` was deleted. Pure
  function with its own test; left rather than widening a deletion past its ruling.
- The sidebar's pin/rename/delete are 30×44. Three 44px targets 2px apart would overlap by 20px and
  the later sibling would win the tap — worse than small. The real fix is a `⋯` menu: a design call.
- F-15 — a second accent element was counted on 2026-08-13 and never identified against the LOCKED
  accent-dosage rule. Inherited, not re-derived.

## 6. Reproducing this session's gates

```bash
git fetch && git rev-parse origin/main       # expect cf58a5f0 or later
npx tsc --noEmit ; echo "exit $?"            # 0, and zero lines of output
npx vitest run --maxWorkers=3                # 567 files / 6562 tests / 0 failed
npm run build                                # exit 0
```

⚠️ **`tsc` clean + suite green does not imply the build passes here** — a `src/lib/surfaces/*`
import into an API route breaks `npm run build` while both stay green. Run it.
