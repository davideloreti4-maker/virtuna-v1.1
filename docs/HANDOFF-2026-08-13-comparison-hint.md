# Handoff — the card rate was never 39%, and comparison asks were the hole (2026-08-13)

**Lane:** composed-card / Apify-first Phase 2 · worktree `~/virtuna-composed-card`
**Predecessor:** `docs/HANDOFF-2026-08-12-composed-card-phase3.md`
**Merged this session:** **#485** (Task 9 + four owner rulings) and **#498** (the comparison hint).

---

## 0. ▶️ START HERE

**Phase 2 is complete and its rate defect is diagnosed and half-fixed. Two numbers everyone was
using are wrong.**

| | |
|---|---|
| **#485** — Task 9, the feed-badge honesty bug, four owner rulings | browser-verified on main |
| **#498** — the comparison hint | comparison asks **5.6% → 72.2%** |

🔴 **Nothing is live.** Production last deployed **2026-08-07**; git is still disconnected from
Vercel. Merging does not ship. `COMPOSED_CARDS` is also still **default-OFF**, so everything in
this lane is inert in production twice over.

**The single most useful thing this session did was isolate the thread.** Every card-rate number
this feature has ever produced was measured through a conversation that replayed all the earlier
asks. Correcting that moved the headline number *down*, and then showed the real defect was not a
rate at all.

---

## 1. 🔴 THE 39% WAS AN INSTRUMENT ARTEFACT

`scripts/probe-composed-card-rate.ts` states in its own header: *"One POST per ask avoids the whole
problem."* **It does not.**

`route.ts:36` imports `openChatPriorTurns`; rehydration is keyed off **`getOpenThread(user.id)` —
the USER, not the request** — and replays up to `MAX_PRIOR_TURNS = 20`. One POST per ask prevents
double-*counting* cards within a thread; it does nothing about server-side rehydration. So every ask
ever measured saw the accumulated transcript of every earlier ask, including near-duplicates of
itself.

**The tell:** ask 2 streamed **byte-identical 1842-char prose on three consecutive runs**, then 2127
once the thread differed. A sampler does not repeat to the byte — the model was echoing its own
prior answer out of replayed history.

```
same six asks, same build, same hour, n=36 per arm:
  thread REUSED (how it was always measured)   14/36 = 38.9%
  thread ISOLATED (maven_active_thread=__new__) 9/36 = 25.0%
```

⚠️ **Send `maven_active_thread=__new__`** (`NEW_THREAD_SENTINEL`, `active-thread-cookie.ts:33`) or
you are not measuring the product. Probe: `scratchpad/probe-clean-rate.mjs` (`ISOLATE` flips arms).

⚠️ **The "18k–33k-char prose wall"** the previous handoff flagged as a separate defect **did not
reproduce clean** — that exact ask now cards 6/6 with short prose. Re-measure before chasing it.

---

## 2. The rate is not a rate — it is per-ASK, and nearly deterministic

Clean, n=6 per ask, **before** the fix:

| ask | cards | shape |
|---|---|---|
| "explain the **structure** of a story-time video, **start to finish**" | **6/6** | structural |
| "break down why this format works: a morning routine narrated like…" | 2/6 | structural, specific |
| "compare posting daily against three times a week…" | 1/6 | **comparison** |
| "what makes an ending actually land on a short video?" | **0/6** | general |
| "confession opening versus question opening…" | **0/6** | **comparison** |
| "greenscreen vs talking head…" | **0/6** | **comparison** |

Three of six ask types never produced a card in 18 clean attempts. **Never describe this as "39% of
the time" or as model randomness** — it is a *selection* failure concentrated on specific ask shapes.

---

## 3. What #498 fixed, and why the wording is load-bearing

The composed-card directive fires on **"when the answer has structure"** (`chat-agent-loop.ts`,
`composeLine`). A comparison ask never says so. The one ask carrying a structural cue *in the
creator's own words* cards 6/6; every comparison cards 0–1/6. The directive was not being refused —
it was not being recognised.

🔑 **The `comparison` recipe was never the blocker.** It exists, it renders (screenshotted in a real
thread 2026-08-12), and it requires no corpus proof (`requiredSlots: ["comparison"]`).

🔑 **Prompt wording is not the lever.** The same directive already says *"Do NOT answer with
markdown: no `##` headings, no bold section labels"* — and the measured failing output was a
markdown essay with `###` headings and bold labels. The model produced verbatim the thing the
sentence forbids. (Four recorded failures of untested wording in this lane, session 10 §5.1.)

`src/lib/tools/compare-hint.ts` appends one cue to the ask **the model reads**, mirroring
`count-hint.ts` exactly:

```
overall clean rate            9/36 · 25.0%  →  22/36 · 61.1%
the three comparison asks     1/18 ·  5.6%  →  13/18 · 72.2%
untouched asks (2,3,4)        8/18 · 44.4%  →   9/18 · 50.0%   (noise, no spillover)
```

A hand-appended stimulus arm (no code) scored **15/18 · 83.3%**, uniform 5/6 across all three.

**Safety, same argument as the count hint:** BUNDLE ONLY (`currentAsk` stays the creator's real
words — it feeds the digest and the persisted transcript); it forces **no** tool call, so there is
no wrong-run exposure; and it is additionally scoped to `COMPOSED_CARDS`, so it is inert until that
flag flips.

⚠️ **The cue string is pinned by test.** A reworded cue is a different stimulus and needs its own
runs.

---

## 4. Do next

1. **Flip `COMPOSED_CARDS=true`** somewhere real. The owner asked for this lane to become visible;
   at 61% clean it is the best evidence available, and the flag is the only thing between the work
   and a creator. *Not done this session — the owner did not rule on it.*
2. **Ask 3 is still 0/6 in BOTH arms** — *"what makes an ending actually land on a short video?"* A
   general question with no comparison shape. It is the next hole and it needs its own cue or its
   own mechanism; do not assume the compare hint generalises.
3. **Re-measure asks 2 and 4 properly.** Both sit around 2/6–5/6 with no fix applied and no
   explanation. n=6 is thin.
4. **The other ten Apify doors** (`SpendAuthority`) — the Phase 3 spec's own §5.1 says this is the
   highest-value part and that the nine-task chat gate chain is aimed at a path taken ~4% of the
   time. **Re-scope Phase 3 before building it.** Owner call, not a code change.
5. **Phase 1 needs a purchase**, not a session — the Apify free cap ($5) gates its release.

---

## 5. Traps carried forward

- **Isolate the thread or you are not measuring the product** (§1). This is the big one.
- **A mutation that reports SURVIVED may be a no-op.** M6 of this session's battery reported
  SURVIVED because its `sed` pattern never matched. Diff the file before believing it.
- **A guard can be untested while its test passes.** M1 (drop the `guessSkill` guard) survived the
  first draft: the generation-request test carried no comparison shape, so a *different* guard
  rejected it and the one under test never ran. Pin a guard with an input that only it rejects.
- **`innerText` is layout-aware.** `/dev/cards` reads as 2516 chars of empty shell while holding
  24825 chars of mounted gallery. Ask "did it mount" with `textContent`. The previous handoff's
  "`/dev/cards` won't mount here" was this, not a defect — the `brief` `stat_row` is now eyeballed.
- **Tab labels append counts** (`Composer8`, `Hidden & legacy5`). Match with a prefix regex.
- **The profile interview is UNREACHABLE**, so its card-9 `400 PGRST204` is not a live bug:
  `ProfileInterviewModal` ← `ContentForm` ← `CommandBar` ← **nothing**. The codebase calls it *"the
  unmounted legacy content-form"* (`AmbientSimulate.tsx:169`). Do not spend a session on it.
- A live chat probe costs credits. This session spent roughly **40–45**.

⚠️ `scratchpad/` is not in the repo. `probe-clean-rate.mjs`, `probe-compare-hint.mjs`,
`mutate-compare-hint.sh` and `probe-card9.mjs` live only in this session's scratchpad.
