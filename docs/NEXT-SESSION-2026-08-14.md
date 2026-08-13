# Next session — copy-paste brief (written 2026-08-13)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Main at handoff:** `32fcedf2`. Branch == main, working tree clean, nothing half-finished.

---

## ▶️ PASTE THIS TO START

```
Read docs/NEXT-SESSION-2026-08-14.md, then docs/HANDOFF-2026-08-13-audit-rewalk.md.

The job: the model claims madlibs it does not instantiate ~81% of the time, so only ~4% of hook
cards keep a proof receipt. The guard that strips them is CORRECT — do not revert it. Fix the
generation side.

Budget: N live billed runs (say how many before you start). One live run cannot clear a gate here;
sample and report a rate.
```

---

## 0.5 🔴 THE DENOMINATOR IS A TEST ACCOUNT — this outranks §2

Found last, and it reframes everything else here. Grouped by `threads.user_id` across every
card-shaped artefact ever persisted:

```
TEST ACCOUNT   843   4 users    (567 of 583 hook cards are e2e-test@virtuna.local)
(anonymous)      3   1 user
REAL USER        1   1 user     ← the entire product history
```

**Every rate in this brief and in the handoff is a probe-account rate.** The ~4% proof receipt, the
80%→4% fall, "controlled for subject" — all of it is one account replaying scripted asks. The CODE
facts stand (the 81% strip, the guard being correct, the gate chain); the framing "a live product
degraded" does not. Nothing regressed for creators, because creators have generated one card, once,
on 2026-07-27.

**So before doing §2's live work, ask whether the ordering is right.** Spending billed runs to raise
a metric on a surface with no traffic may be the wrong call — and that is an owner question, not an
engineering one. See `memory/remix-has-no-real-users.md` (the trunk session found this on the remix
lane; it is a whole-product fact, not a remix one).

⚠️ **`messages.body` has TWO shapes** (`messages.ts:94-96`): a bare array, or `{kcGenVersion, blocks}`.
54 assistant rows are bare arrays. Every query must use
`case when jsonb_typeof(body)='array' then body else body->'blocks' end`, and every rate must
`group by threads.user_id` before the word "measured" is used.

---

## 1. What this session did

Two PRs merged. **Read `docs/HANDOFF-2026-08-13-audit-rewalk.md` before touching grounding.**

| | |
|---|---|
| **#488** `af9df4f3` | the type-level fence — `writing_voice_sample` → `writing_voice_description`; Card 9 of the interview was the producer the spec called hypothetical, and its answer is silently discarded |
| **#491** `32fcedf2` | F-4: the wait stops promising an outcome it cannot know yet · **the audit re-walk — all 22 findings re-measured in a browser for the first time since 2026-08-09** |

---

## 2. 🔴 THE ONE THING TO GET RIGHT

**The proof-receipt rate is ~4%. The guard is not the bug. Do not revert it.**

`templateInstantiated` (`output-guards.ts:99`) strips a citation whose madlib the hook does not
instantiate — 81% of them, replayed over 58 real pre-regression pairs. That looks like a
catastrophic regression and it is not:

`prompt.ts:217-222` tells the model *"INSTANTIATE the madlib … Tag each hook with the sourceIndex
of the example **it instantiates, or 0 if none**."* A card citing source N therefore **asserts** it
instantiated madlib N. When it demonstrably did not, the citation is **false**, and stripping it is
correct. **Reverting restores false provenance claims to the product.** I nearly shipped that revert;
the steelman is the only reason I didn't.

Re-derive it yourself in one command before proposing anything:

```bash
node scripts/fetch-madlib-pairs.mjs
node node_modules/.bin/tsx scripts/replay-madlib-guard.ts     # 58 pairs · 11 pass (19%) · 47 stripped (81%)
```

⚠️ **Do not quote "80% → 4%" as lost grounding.** ~81% of what disappeared was false. Honest
attribution fell roughly **15% → 4%**. The `diversity.admit` cap (cap 2/source/run, added the same
day) is the prime suspect for the remainder and is **unmeasured** — separating the two is a good
first move and it is free.

**The real defect is generation quality:** the model does not instantiate the structures it is shown,
then claims it did. That is what the surface's whole differentiation claim rests on.

---

## 3. Where to start, in order

1. **Split the two causes, free.** How much of the 4% is the madlib strip vs `diversity.admit`?
   Both gates are on one line (`hooks-runner.ts:807`). Instrument, don't reason.
2. **Then the live work.** Does the model instantiate better when the madlib is the *only* thing in
   the slot, or when it is asked to quote the skeleton back first? This lane's standing rule:
   **prompt wording is a dead lever — four recorded failures.** Prefer a structural change.
   ⚠️ Sample N and report a rate; `temperature: 0` + a fixed seed is NOT reproducible on DashScope.
3. **F-1 is still live at ~8%** (8 confirmed cases, re-answers up to 20,742 chars). `POST_TOOL_TEXT_CAP`
   never sees them — they persist as a **separate message**, and the cap only truncates anyway.
   Key any fix on *duplication of cards already delivered this turn*, never on shape.
   ⚠️ Do NOT widen the artefact guard's STRUCTURE rule to signed-in creators — for a paying creator
   an enumerated pack **is** the product.
4. **Mechanical and unblocked:** F-13 (composer backdrop is still `background-image: none` — a
   one-line gradient), F-14's heading half (zero `h1`–`h4` in the whole thread), F-19 (84 tap
   targets under 40px).
5. **Card 9** is a two-way door: wire it (column + whitelist — the fence makes the slot safe) or
   drop the card. Owner's call; a new prod column is live DDL and `supabase db push` is unsafe here.

---

## 4. Verification recipe (works, used today)

```bash
npm run dev -- --port 3015                                     # one server per port; check lsof first
node scripts/mint-auth-state.mjs http://localhost:3015         # reads .env.local itself
node scripts/probe-audit-rewalk.mjs      http://localhost:3015 <threadId>   # both viewports, native
node scripts/probe-cards-and-measure.mjs http://localhost:3015 <threadId>   # ch by the audit's method
```

All five probes are **tracked in `scripts/`** — the `.scratch/` copies are gitignored and will not
survive `git worktree remove`.

⚠️ `.scratch/auth-state.json` is a REAL session for a REAL prod account. Gitignored; keep it that way.
⚠️ A live probe reuses the account's open thread — send `maven_active_thread=__new__`.
⚠️ `BILLING_ENFORCE_QUOTA` is true in prod and dev shares prod's Supabase. Driving skills costs money.

---

## 5. 🔴 THE METHOD LESSON THIS SESSION PAID FOR

**An absent field reads as a clean result.** Three times in one session I nearly published a
confident wrong answer:

| query | what it "showed" | why it was wrong |
|---|---|---|
| `body->>'markdown'` | F-1 fixed since July | the key does not exist; prose is a **block** at `props.text` |
| prose in the same message | F-1 fixed | the re-answer is a **separate message** |
| `sourceIndex` on hook-card | 100% ungrounded | not a prop; the real keys are `grounded` + `proof` |

**Run `jsonb_object_keys` before dividing by any jsonb field.** And the broader version, which is the
one that mattered most today: *the obvious fix for a measurement is sometimes the opposite of the
right one.* Steelman the finding before shipping against it.

---

## 6. Housekeeping

- 🔴 **The lane memory index is STALE** — it still says "session 12" and repeats the
  *"do not ship the `writing_voice_sample` migration"* framing that #488 resolved. The worktree path
  guard blocks writing to `~/.claude/projects/.../memory/` from here; it can only be corrected from
  trunk. The merged handoffs are authoritative.
- Nothing is deployed. Production last shipped **2026-08-07**; merging does not deploy. Verify on
  `virtuna-v11.vercel.app`, never `numenmachines.com` (404s BY DESIGN).
- A trunk session shipped `ENGINE_PROSE_CALL_PIN` (#489, dark) today and is idle. It knows this
  lane's state.
