# Handoff — the audit re-walk: a silent P0 regression the engine work hid (2026-08-13)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Re-measures:** `docs/HANDOFF-2026-08-09-in-thread-chat-audit.md` (F-1…F-22), against main after 4 days
of engine work. **Read-only walk — no skill dispatched, no credits spent.**

---

## 0.0 🔴🔴 READ THIS BEFORE ANY NUMBER BELOW — THE DENOMINATOR IS A TEST ACCOUNT

**Added 2026-08-13, after the rest of this document was written and merged. It does not retract the
findings; it retracts what they are ABOUT.**

Every rate in this handoff is a **probe-account rate, not a production rate.** Grouped by
`threads.user_id` over every card-shaped artefact ever persisted:

```
TEST ACCOUNT   843 artefacts   4 users   2026-06-28 → 2026-08-12
(anonymous)      3 artefacts   1 user    2026-07-26
REAL USER        1 artefact    1 user    2026-07-27
```

**One artefact, from one genuine creator, in the product's entire history.** Hook cards specifically:
**567 of 583 are `e2e-test@virtuna.local`** — my own probe account, running scripted asks.

So "the proof-receipt rate collapsed 80% → 4%" describes **what a test harness got**, and
"controlled for subject" means controlled within one account replaying one scripted ask. Neither
sentence licenses a claim about creators. Nobody's cards regressed, because nobody has cards.

**What still stands, because it is a CODE fact and not a rate:**
- `templateInstantiated` strips 81% of citations on real (hookLine, madlib) pairs — replayed over
  the real exported guard, `scripts/replay-madlib-guard.ts`.
- The guard is CORRECT (§0's prompt.ts argument). Unaffected — that is read off the prompt.
- The gate chain at `hooks-runner.ts:807` and `corpusAdapted` always being false.

**What does NOT stand:** any framing in which this degraded a live product, cost creators anything,
or is urgent because users are affected. It is a latent defect in a surface with no traffic.

🔑 **The method rule this bought: `group by threads.user_id` BEFORE writing the word "measured".**
A count is not a rate, and a rate over one synthetic account is not a rate at all. Found by the
trunk session on the remix lane (`memory/remix-has-no-real-users.md`) and generalised here — it is
not a remix-lane fact, it is a **whole-product** fact.

⚠️ Also: `messages.body` has TWO shapes (`messages.ts:94-96` — a bare array, or
`{kcGenVersion, blocks}`). **54 assistant rows are bare arrays** and every `body->'blocks'` query in
this document missed them. Re-run under both shapes, the hook-card numbers are **unchanged** (no
hook cards live in bare-array bodies) — but any NEW query must use
`case when jsonb_typeof(body)='array' then body else body->'blocks' end`.

---

## 0. ▶️ THE HEADLINE

🔴 **The proof-attachment rate on hook cards collapsed from ~80% to ~4%, and nothing caught it.**

Controlled for subject — the *same* "student budgeting app" ask:

| date | cards | with `proof` | rate |
|---|---|---|---|
| 2026-08-04 | 15 | 12 | **80%** |
| 2026-08-11 | 25 | 2 | **8%** |
| 2026-08-12 | 70 | 3 | **4.3%** |

Other subjects move the same way (08-08: 8/10 = 80% → 08-10: 9/95 = 9.5%), so it is **not a subject
artefact**. The window is **between 2026-08-08 and 2026-08-10**.

🔑 **And `grounded: true` is set on 260 of 260 cards** while only 72 carry any proof at all. The flag
asserting grounding and the payload proving it have come completely apart. That is F-4 —
*"the loading state promises grounding the cards don't deliver"* — at its worst reading yet.

**This is the cost of the charter drift.** Sessions 11 and 12 contain zero browser evidence and the
suite was green at 6,300+ tests throughout. A regression in the product's differentiator sat
unnoticed for five days because verification never left the wire.

### ✅ BISECTED — the cause is `templateInstantiated`, and its cost was measured on the day it shipped

**Commit `7d4bc133` (2026-08-10, "Stage A — contracts & honesty")** added the N-1 rule:
*"a citation whose madlib the output does not instantiate drops to an honest 'Original'."*
That is `templateInstantiated` (`output-guards.ts:99`), applied at `hooks-runner.ts:807`:

```js
const proof = rawProof
  && (corpusAdapted || templateInstantiated(rawProof.hookTemplate, candidate.hook.hookLine))
  && diversity.admit(rawProof.videoUrl ?? rawProof.handle) ? rawProof : null;
```

🔑 **`corpusAdapted` is always false** — it requires `GROUNDING_HOOKS_ADAPT === "true"`
(`hooks-runner.ts:124`), which is dark. So every live run hits the lexical check.

**Measured, not inferred** (`.scratch/replay-madlib-guard.ts` — imports the REAL exported guard, not
a copy): replay the *current* guard over **58 pre-regression cards that DID carry proof**, i.e. the
same data the old pipeline judged honest —

```
pairs          58
guard PASSES   11  (19.0%)
guard STRIPS   47  (81.0%)     ← each renders "Original — not drawn from a retrieved video."
```

19% predicted survival vs 4–9.5% observed: same order, with the residual explained by the **second**
gate (`diversity.admit`, cap 2 per run) compounding on top.

🔴 **The cost was already measured, on the same day, and the remedy was bound too narrowly.** The
very next commit — `af9e5fc8`, 35 minutes later — says the check *"strips 23/28 honest citations"*
(**82%**, within a point of my 81%). But it applied the madlib check "only when the slice shipped",
which fixes the **adapt** path — and adapt is dark. The default path was left fully exposed.

### 🔴 …AND THEN THE REVIEW OVERTURNED THE CONCLUSION. THE GUARD IS RIGHT.

**My first reading was that the guard punishes re-voicing** — that a hook turning `Here are [N]
[Niche Category] no one talks about` into *"This is the only screenshot you need…"* has borrowed the
structure while sharing none of the words, and that a lexical check cannot see structural transfer
(the `exemplars-get-copied-verbatim` lesson, inverted). **I was one step from shipping a revert.**

The steelman kills it. `prompt.ts:217-222` — what the model is actually told on this path:

> *"Each MADLIB is the reusable skeleton the hook ran on. **INSTANTIATE the madlib** for THIS
> creator — fill its [brackets] with their … Tag each hook with the sourceIndex (1-N) of the example
> **it instantiates, or 0 if none**."*

The model is shown the madlib, told to instantiate it, and told to cite **0** when it doesn't. So a
card citing source N is *asserting* it instantiated madlib N. When it demonstrably did not, **the
citation is false and stripping it is correct.** Reverting would restore false provenance claims to
the product.

`af9e5fc8`'s 23/28 measurement does **not** transfer: it was taken on the ADAPT path, where the
model consumes the briefer's already-FITTED line and never sees the madlib — re-voicing is the
design *there*, which is exactly why that commit scoped the check to the raw slice. That scoping was
right. My 81% is the same arithmetic applied to a path where the claim is real.

### What this actually means — and a correction to §0's framing

The guard did not break grounding. **It exposed that most citations were always decorative.**

| | displayed receipt | of which honest | honest attribution |
|---|---|---|---|
| before 2026-08-10 | ~80% | ~19% | **~15%** |
| after | ~4% | ~100% | **~4%** |

⚠️ **So "80% → 4%" overstates the loss.** The displayed-receipt rate did fall 20×, but ~81% of what
disappeared was false. Real honest attribution fell roughly **15% → 4%** — a genuine drop worth
explaining (the `diversity.admit` cap landed the same day and is the prime suspect for the
remainder), but not the catastrophe the raw numbers suggest. **Do not quote 80% → 4% as lost
grounding.**

### The defect that IS real, and it is upstream

`grounded` is not lying either — `blocks.ts:133-148` defines it as *"did THIS RUN have retrieved
sources at all?"*, deliberately distinct from `proof`, with an explicit **"Never infer it from
`proof`"**. `grounded: true` + no proof is the designed, honest state: *we had real sources and the
model wrote this one from scratch.*

So the chain is: retrieval works (260/260) → the model is told to instantiate a madlib → **it claims
a source it did not instantiate ~81% of the time** → the guard correctly strips it → 4% receipts.

**The defect is generation quality, not plumbing.** The model does not do the one thing this
surface's differentiation claim rests on. That needs live runs to fix and is out of scope here.

**What IS shippable and still true is the audit's own F-4 diagnosis:** the loading spine asserts
*"Borrowing shape from 5 proven videos"* **before it can know whether any card will borrow**. With
honest attribution at ~4%, that copy is wrong ~96% of the time. The audit said it exactly:
*"the defect is upstream: the loading copy asserts an outcome before it is known."*

---

## 1. Two defects that were never in the original 22

**N-1 · Model reasoning is rendered to screen.** 9 persisted messages, first 2026-07-17, most recent
**2026-08-12**. Verbatim from the top of a rendered `markdown` block:

> *"The user wants an explanation of the structure of a story-time video, start to finish.
> This is a request for information/education on a specific content format.
> I need to break down the anatomy of a successful TikTok story-time video."*

That is internal monologue shipped as the answer.

> 🟢 **N-1 — PERSISTENCE half CLOSED in #523** (`cf58a5f0`, 2026-08-16). `reasoning-leak.ts` drops
> the three attested tag shapes at assembly and returns untagged input **byte-identical**, so a
> healthy answer is never even trimmed. ⚠️ **It still STREAMS** — nothing withholds tokens, by owner
> ruling (withholding means buffering). Tracked as task #31, not as an F-row.
>
> ⚠️ **The trigger was never reproduced**: 0 of 21 live runs on 2026-08-16 across four request
> shapes (`scripts/probe-thinking-content-channel.ts`), including the shipped 25,268-char prompt.
> Production leaked on 3 of 4 identical asks on 08-12 and 0 of 6 on 08-13. **A clean run is not
> evidence this is gone** — that is precisely why the fix is a boundary guard and not a prompt
> change. There is nothing to A/B.

**N-2 · One persisted answer is 33,165 characters.** The audit's F-11 complaint was a 3,663px
answer ≈ 4 screens. 33k characters is roughly an order of magnitude beyond that.

> 🟢 **N-2 — CLOSED in #523.** `RUNAWAY_PROSE_CAP` (8,000) bounds the no-card branch, which had no
> ceiling at all. The threshold sits in a **measured empty gap**: across the whole production
> `messages` table the largest legitimate answer is 3,791 chars and the smallest leak is 18,484.
> Nothing lives in between, so it separates the two populations without touching the real one.
> 🔴 This is **not** the prose cap the lane forbids — biting the 25 search-and-answer turns would
> need it near 600, and a test pins a 4,278-char answer passing through untouched.
>
> That row (`249848cb`, 33,165 chars) is also **tagless**, which is why the strip alone was never a
> ceiling and why the cap had to reach the anonymous `/go` exit too (`chat-agent-loop.ts:1685`).

---

## 2. F-1…F-22 status, measured

> 🔴 **FIVE ROWS BELOW ARE STALE. Read `HANDOFF-2026-08-15-three-orphans.md` §3 first.**
>
> **F-13, F-14, F-18 and F-19 were FIXED in #495**, one day after this table was written, and each
> is marked 🔴 STILL LIVE here. Do not re-investigate them.
>
> 🔴 **And F-4 was fixed in #491 — the SAME COMMIT THAT ADDED THIS FILE.** The row is the finding
> that motivated the fix, written in its pre-fix voice, and never updated when the fix landed
> beside it. It was not true even at merge. Before treating any row here as open,
> `git log --all --grep="F-<n>"`.
>
> ~~Also corrected since: **F-1, F-7 and F-22 were re-derived on 2026-08-14 and are still true**~~
> 🔴 **F-1 and F-7 are now CLOSED too — #514 (`697a4b67`, 2026-08-15).** F-22 stands. Verified in
> code 2026-08-16: `createSourceDiversityCap()` (`output-guards.ts:182`) is called by **both**
> runners (`hooks-runner.ts:790`, `ideas-runner.ts:725`) and pinned by `source-diversity.test.ts`;
> F-1's assembly drop is `cardsDelivered` at `chat-agent-loop.ts:1413`/`:1568`, consumed at `:1670`.
>
> 🔴 **AND TWO OF THE FOUR "unmeasured" ROWS WERE ALREADY FIXED WHEN THIS TABLE WAS WRITTEN.**
> **F-3** was fixed by `7d4bc133` on 2026-08-10 — *three days before this file* — and **F-8's
> `fitLabel` half** by `53fe7323` on 2026-08-11. Both were carried forward as "needs a live billed
> run" through four successive briefs. Neither ever needed one. See the rows below for the code.
>
> ⚠️ The measurements below are still worth having. It is the STATUSES that expired. This is the
> same failure the lane keeps paying for: a claim lives in several copies and fixing one leaves the
> rest lying. **⚪ unmeasured does not mean unfixed** — nobody had looked, and that is not the same
> thing as nobody having fixed it. `git log --all --grep` before budgeting a run against any row.

| # | finding | status | evidence |
|---|---|---|---|
| **F-1** | pack renders twice | 🟢 **CLOSED in #514** (was: 🔴 STILL LIVE, ~8%) | *Measurement, still valid as of 08-13:* 8 confirmed assistant→assistant pairs, gaps 0.1–0.3s, no user turn between; re-answers 793–20,742 chars. 2 of 24 packs on 08-12. **Visually confirmed** (`.scratch/rewalk-desktop.png`). *Fix:* pre-card narration is dropped at assembly (`cardsDelivered`, `chat-agent-loop.ts:1413`/`:1568` → `:1670`), never buffered, and over-budget post-card text is dropped **whole** rather than truncated |
| F-2 | prose contradicts its button | 🟠 partially visible | The walked thread shows duplicate closing questions; the #N mismatch itself did not reproduce here |
| F-3 | audience name flips | 🟢 **FIXED — and already was when this row was written** | `7d4bc133` (Stage A, 2026-08-10) names F-3 in its own message. The literal is gone: `thread-turn.tsx:252` falls back to `'your audience'`, never `'General'` — with the reasoning in the comment above it ("General is the NAME of a real audience, so guessing it here was indistinguishable from knowing it"). And the chat path *does* resolve an audience before stamping: `chat/route.ts:412` `resolveThreadAudience(...)` → stamped at `:683`. Both halves of the 2026-08-09 root cause are closed. **No live run needed** |

| **F-4** | loading promises grounding cards disclaim | 🔴 **STILL LIVE, WORSE** | 5/5 cards disclaimed on the walked thread; systemically the 4% proof rate in §0 |
| F-5 | unfilled `[placeholders]` on screen | 🟠 masked | all 6 meta-templates still in `outlier_teardowns`; did not render here **because no card carried proof at all** |
| F-6 | jittery multiplier shown as proof | 🟢 **likely resolved on this surface** | `matchRowToExample` reads `honestMultiplier(row.outlier_multiplier)` straight from the row — the durable number, not the within-set one. ⚠️ **NOT via the 2026-08-11 receipt fix** — `attachOutlierReceipt`'s 3 call sites are `/api/discover`, `/api/tools/explore`, `explore-runner`; **the thread is not one of them.** Don't quote that memory line as covering the thread |
| **F-7** | same source on 3 of 5 cards | 🟢 **CLOSED in #514** (was: 🔴 STILL LIVE in code) | ⚠️ **This row's own evidence was the trap.** "`build-proof.ts` … still no diversity constraint" is true and irrelevant — that file **structurally cannot hold the fix**. The cap already existed in `hooks-runner` (since `7d4bc133`); `ideas-runner` simply never called it. Both call `createSourceDiversityCap()` now (`:790` / `:725`, defined `output-guards.ts:182`), pinned by `source-diversity.test.ts` — neither runner had *any* test before, so the cap could have been deleted with the whole suite green |
| F-8a | static `fitLabel` ("every card says ◐ adjacent") | 🟢 **FIXED** | `53fe7323` (2026-08-11, receipts materialize server-side, D7). Production hard-codes `fitLabel: null` — `composed-card-receipt.ts:104` (with the honest reason in its header: *"nothing measured this row against this creator's audience"*) and `remix-runner.ts:434`. `proof-receipt.tsx:102` renders **no glyph at all** on null. The only surviving `"adjacent"` literals are dev fixtures + test fixtures. The fabricated glyph cannot recur. **No live run needed** |
| F-8b | fixed persona roster (same five names/percentages) | ⚪ **still unmeasured** | Genuinely open, but **not** a hardcode: `profile-runner.ts:186` derives personas from `sig.audience.personas` — the bake signature. So a repeated roster would mean repeated *calibration input*, not a static list. Needs a live run **with a calibrated audience**; an uncalibrated one proves nothing. ⚠️ The audit's "a *Lurker* persona narrated in why-it-works that exists in no roster" — the string `Lurker` occurs **nowhere in `src/`** as of 2026-08-16 |

| **F-9** | small, wide, grey body text | 🟢 **FIXED** | **16px / 26px, 68ch, `#ece7de` cream** — was 14px / 22.75, 75ch, secondary grey. Now on the convergent norm the audit named |
| F-10 | 14 text roles in one answer | 🟢 **IMPROVED** | 13 distinct roles desktop **and** mobile — was 14 desktop / 19 mobile |
| **F-11a** | the transport does not stream | 🟢 **FALSE — never was true at audit time** | `route.ts` sends `event: token` per delta; `use-chat-stream.ts:295` does `setStreamingText` per token. Wired since `216df989` (**2026-06-21**), two months *before* the audit. Proven live from the opposite direction: **#523 exists because leaked reasoning STREAMED to the creator in real time.** Text that streams cannot also not-stream |
| **F-11b** | dead air before the first character | 🔴 **STILL LIVE — measured 2026-08-16, and it IS the row** | `scripts/probe-f11-stream-timing.ts`, N=4 per shape, free (billing omitted). **Prose: median first token 5.28s** (4.64 · 4.71 · 5.28 · 5.47). **Skill: median 4.04s** (3.65 · 3.71 · 4.04 · 5.15), dispatching `generate_hooks` 4/4. The audit's ~5.5s is intact — a year of lane work never touched it. This is the whole of F-11 |
| **F-11c** | text arrives in one paint | 🟢 **FALSE for prose** | 63–104 separate token frames per answer; **median max inter-token gap 0.18s**, worst observed 0.88s. There is no long silence for a burst to sit behind. Once text starts it flows |
| F-11d | cards arrive all at once | ⚪ **genuinely unmeasured** | `onBlock` fires per block (`chat-agent-loop.ts:1331`/`:1380`/`:1411`), so incremental arrival is *possible* — but blocks never materialise without a billing seam, so the free probe cannot see it. **Needs a paid run.** Count blocks off the SSE, not the DOM |
| F-12 | the wait happens in a void | ⚪ **unmeasured — needs a BROWSER, not a probe** | It is a layout claim (progress card pinned to viewport top, ~600px of dead space to the composer), so neither the suite nor a loop-level probe can see it. ⚠️ Open a context at the **native** viewport — resizing a loaded page does not give you the mobile UI. ⚠️ `main` is not the scroller on `/home`, so a fullPage screenshot stops at the fold. 🔎 **Adjacent, measured 2026-08-16:** `onDispatch` — the event that lets the progress capsule *label itself* — fires at `chat-agent-loop.ts:1552`, **after** the billing gate at `:1528`, though its interface comment (`:322`) says *"the moment the agent COMMITS … BEFORE `run`"*. "Before `run`" holds; "the moment it commits" does not — a credit-gate round-trip sits in between and the capsule is unlabelled for it. Small beside F-11b, same wait |
| **F-13** | composer guillotines content | 🔴 **STILL LIVE** | `composer-backdrop` computes `background-image: none`, `background-color: rgb(31,31,30)` — still a solid fill, still a hard cut. The one-line gradient was never applied |
| **F-14** | structure + a11y | 🟠 **HALF FIXED** | unnamed icon buttons **0** (was 4) ✅ · **headings still 0** — zero `h1`–`h4` in the entire thread ❌ |
| F-15 | accent dosage clean | 🟠 **check** | **2** accent elements (was 0). One is the brand mark (sanctioned). Identify the second against the LOCKED rule |
| **F-16** | mobile composer clips typing | 🟢 **FIXED** | composer is **191px** tall and grows — was fixed at 48px. The audit's "single worst mobile defect" |
| F-17 | audience rail 0×0 on mobile | 🟢 present | `@mrbeast · CALIBRATED · 5 RANKED` strip renders on mobile |
| **F-18** | no top bar, no scrim | 🔴 **STILL LIVE** | **Visually confirmed** (`.scratch/rewalk-mobile.png`) — the ☰ overlays body text and clips "Th" off "The strongest one is" |
| **F-19** | tap targets under 40px | 🔴 **STILL LIVE** | **84** elements under 40px (audit: 62–84). Unchanged |
| **F-20** | dead space below composer | 🟢 **FIXED** | **16px** — was ~96px |
| F-21 | retrieval starved | 🔴 subsumed by §0 | the 4% proof rate is a far larger version of this |
| F-22 | corpus null multipliers | 🔴 unchanged | `follower_count` NULL on all 532 rows; 0 rows labelled "vs followers"; max multiplier 20,154.7× |

~~**Tally: 5 fixed · 5 still live · 3 half/masked · 4 unmeasured (need a live run) · plus 2 new.**~~

🔴 **The tally as written on 2026-08-13 is void — do not quote it.** The rows it counted have been
closed by five different PRs since (#491, #495, #514, #523) and it was already wrong on the day, by
two rows. It is left struck through rather than recomputed because a fresh number here would just
start expiring again; **read the statuses, not the total.**

**The only part worth carrying forward is the live-run budget — and after 2026-08-16 it is smaller
again.** F-3 and F-8a needed nothing (fixed in code before this file existed). **F-11 was measured
for FREE** — `probe-f11-stream-timing.ts` drives the real loop with the real 25,268-char prompt and
omits `deps.billing`, so billable skills fail closed and nothing is spent. It split three ways:
**F-11a and F-11c are false, F-11b is real and is the whole row.**

What still needs a **paid** run: **F-11d** (do cards arrive one-by-one) and **F-12** (the wait's
layout — which also needs a browser at a native viewport, not a resized one). **F-8b** joins them
only alongside a *calibrated* audience.

🔑 **Before budgeting a run, ask which half of the row the money is actually for.** F-11 read as one
indivisible "needs a live billed run" for four briefs. Three of its four parts turned out to be
answerable from code plus a free loop probe.

---

## 3. ⚠️ METHOD — three false negatives I nearly published

Recorded because each would have produced a confident wrong answer, and this lane has published
one before (`emit-card-fires-in-a-later-round`).

1. **`body->>'markdown'` does not exist.** Card-bearing messages carry only `blocks` +
   `kcGenVersion`. My first F-1 query returned "0 prose beside cards on every day since July" — a
   clean, plausible, *entirely wrong* "F-1 is fixed". The prose is a `markdown` **block** at
   `props.text`.
2. **F-1's re-answer is a SEPARATE message.** Even with the right key, "prose in the same message"
   returns 0. `POST_TOOL_TEXT_CAP = 600` (`chat-agent-loop.ts:1099`) caps text *within a round*, and
   the duplicate lands in its own row where the cap never sees it. It also only ever **truncates**
   (`slice(0, room)`) — so when it does bite, the creator gets 600 chars of duplicate pack cut
   mid-sentence, not no duplicate.
3. **`sourceIndex` is not a hook-card prop.** The real keys are `grounded` and `proof`. Querying the
   non-existent one made `coalesce(…,0)=0` true for every row → a confident **"100% ungrounded"**.
   Verify a key exists before dividing by it.

🔑 **The pattern in all three: an absent field reads as a clean result.** Check `jsonb_object_keys`
before believing any aggregate over jsonb.

Also: `[class*="card"]` matched nothing — the thread's cards carry no "card" substring in their
classes, and the thread region exposes only **2** `data-testid`s total. Selector-based DOM counts on
this surface are unreliable; measure off structure or add testids.

---

## 4. Do next, in order

1. 🔴 **Bisect the proof collapse.** Window 2026-08-08 → 2026-08-10. This is the product's
   differentiator and it is 4%. Everything else on this list is smaller.
2. 🔴 **Reconcile `grounded` with `proof`.** A card asserting `grounded: true` with no proof is the
   honesty spine inverted — the flag should be derived from the payload, not set beside it.
3. **F-1**: key the fix on *duplication of cards already delivered this turn*, not on shape.
   ⚠️ Do NOT widen the artefact guard's STRUCTURE rule to signed-in creators — for a paying creator
   an enumerated pack **is** the product. (Established with the trunk session, which built
   `ENGINE_PROSE_CALL_PIN` today; its withholding guard keys on a 14-char tool-name token and does
   **not** generalise to this shape.)
4. **F-13** is still a one-line gradient. **F-14**'s heading half and **F-19**'s tap targets are
   unchanged and mechanical.
5. ~~**The 4 unmeasured findings** (F-3, F-8, F-11, F-12) need one live billed run between them.~~
   🔴 **Corrected 2026-08-16 — it is 2, not 4.** F-3 (`7d4bc133`) and F-8a (`53fe7323`) were both
   already fixed in code when this list was written. **F-11 and F-12** are the live-run budget, and
   F-8b joins them only if the run uses a *calibrated* audience. Both remaining rows are
   timing/feel, so they need a **prod build in a browser** — the suite cannot see either.
   Budget deliberately — `BILLING_ENFORCE_QUOTA` is on and dev shares prod's Supabase.

---

## 5. Reproducing this walk

```bash
node .scratch/mint-auth-state.mjs http://localhost:3015      # signed-in state, reads .env.local itself
npm run dev -- --port 3015
node .scratch/probe-audit-rewalk.mjs      http://localhost:3015 <threadId>   # both viewports
node .scratch/probe-cards-and-measure.mjs http://localhost:3015 <threadId>   # ch by the audit's method
```

⚠️ `.scratch/` is gitignored and is the only copy. Artefacts: `rewalk.json`, `cards-measure.json`,
`rewalk-desktop.png`, `rewalk-mobile.png`, `rewalk-pack-top.png`.

Traps that cost time here: a bare `"() => {…}"` string in `page.evaluate` returns the **function**
(unserialisable → `undefined`) — invoke it as `` `(${FN})()` ``. And the thread scrolls in
`[data-testid="composer-thread-region"]`, never the body.
