# Handoff — the audit re-walk: a silent P0 regression the engine work hid (2026-08-13)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Re-measures:** `docs/HANDOFF-2026-08-09-in-thread-chat-audit.md` (F-1…F-22), against main after 4 days
of engine work. **Read-only walk — no skill dispatched, no credits spent.**

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

**N-2 · One persisted answer is 33,165 characters.** The audit's F-11 complaint was a 3,663px
answer ≈ 4 screens. 33k characters is roughly an order of magnitude beyond that.

---

## 2. F-1…F-22 status, measured

| # | finding | status | evidence |
|---|---|---|---|
| **F-1** | pack renders twice | 🔴 **STILL LIVE, ~8%** | 8 confirmed assistant→assistant pairs, gaps 0.1–0.3s, no user turn between; re-answers 793–20,742 chars. 2 of 24 packs on 08-12. **Visually confirmed** (`.scratch/rewalk-desktop.png`) — two competing closing questions above the chip |
| F-2 | prose contradicts its button | 🟠 partially visible | The walked thread shows duplicate closing questions; the #N mismatch itself did not reproduce here |
| F-3 | audience name flips | ⚪ unmeasured | needs a live run |
| **F-4** | loading promises grounding cards disclaim | 🔴 **STILL LIVE, WORSE** | 5/5 cards disclaimed on the walked thread; systemically the 4% proof rate in §0 |
| F-5 | unfilled `[placeholders]` on screen | 🟠 masked | all 6 meta-templates still in `outlier_teardowns`; did not render here **because no card carried proof at all** |
| F-6 | jittery multiplier shown as proof | 🟢 **likely resolved on this surface** | `matchRowToExample` reads `honestMultiplier(row.outlier_multiplier)` straight from the row — the durable number, not the within-set one. ⚠️ **NOT via the 2026-08-11 receipt fix** — `attachOutlierReceipt`'s 3 call sites are `/api/discover`, `/api/tools/explore`, `explore-runner`; **the thread is not one of them.** Don't quote that memory line as covering the thread |
| **F-7** | same source on 3 of 5 cards | 🔴 **STILL LIVE in code** | `build-proof.ts` is a pure `sourceIndex → example` lookup, still no diversity constraint. Unreproducible on screen right now only because proof is nearly always absent |
| F-8 | fixed persona roster / static `fitLabel` | ⚪ unmeasured | needs a live run |
| **F-9** | small, wide, grey body text | 🟢 **FIXED** | **16px / 26px, 68ch, `#ece7de` cream** — was 14px / 22.75, 75ch, secondary grey. Now on the convergent norm the audit named |
| F-10 | 14 text roles in one answer | 🟢 **IMPROVED** | 13 distinct roles desktop **and** mobile — was 14 desktop / 19 mobile |
| F-11 | nothing streams | ⚪ unmeasured | needs a live run to time |
| F-12 | the wait happens in a void | ⚪ unmeasured | needs a live run |
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

**Tally: 5 fixed · 5 still live · 3 half/masked · 4 unmeasured (need a live run) · plus 2 new.**

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
5. **The 4 unmeasured findings** (F-3, F-8, F-11, F-12) need one live billed run between them.
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
