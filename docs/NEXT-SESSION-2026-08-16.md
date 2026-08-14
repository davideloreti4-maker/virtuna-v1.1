# Next session — copy-paste brief (session 14 close-out, 2026-08-14)

> 🔴 **SUPERSEDED by `NEXT-SESSION-2026-08-16-after-514.md` (session 15, 2026-08-15).** Read that
> first. Optional items 1–3 below are all resolved: **F-1 and F-7 are CLOSED** and
> **`ENGINE_GEN_CONVERSATION` is default ON**, all in PR #514. The `text-foreground-tertiary` loose
> end in §5 was measured **FALSE** — nothing styles with it. §2's flag table is corrected in place.

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Main at close:** `8765579a`. Branch == main, tree clean, **nothing half-finished, nothing in flight.**
**Merged this session:** **#502** (the three orphans) · **#506** · **#507** · **#509** (docs + two corrections).

> ✅ **This lane is at a CLEAN STOPPING POINT.** Everything below is optional. The owner is moving
> to new work; do not treat the open list as a queue you must drain.

---

## ▶️ PASTE THIS TO START

```
Read docs/HANDOFF-2026-08-15-three-orphans.md.

Repo ~/virtuna-in-thread-chat, branch lane/in-thread-chat, main at 8765579a. tsc + build +
6419 tests green, working tree clean, nothing in flight.

⚠️ RE-CHECK MAIN BEFORE YOU BRANCH. It moved FOUR times underneath me last session, from
trunk sessions working other lanes. `git fetch && git rev-parse origin/main` — then again
before you open a PR.

CONTEXT IN ONE LINE: this is the in-thread chat lane — chat runs the tools, and the last
week has been auditing and repairing what that surface actually produces. Session 14 closed
the three orphans: the creator interview is now 3 questions inside /welcome's calibration
wait, ContentForm/CommandBar are deleted, /go is untouched by owner ruling.

🔴 BEFORE TREATING ANY INHERITED CLAIM AS OPEN WORK:
  git log --all --grep="<the claim>"
Two claims bit me last session — F-4 and the exemplar defect — both already fixed, both
still described as broken in a doc and in the lane memory. Hand re-derivation confirms what
is still broken and is BLIND to what someone else already fixed. I hand-checked three claims
and was right on all three; I was wrong on both I did not grep.

OPTIONAL WORK, if the owner wants this lane continued (they may not — ask):
  1. ENGINE_GEN_CONVERSATION — built, merged, DARK. The generators still cannot see the
     conversation. One env var. The highest-value unfinished thing in this lane.
  2. F-1 — the pack renders twice, ~8%. Key the fix on duplication of cards ALREADY
     DELIVERED THIS TURN, not on shape. The re-answer is a SEPARATE message, so a
     "prose in the same message" query returns a clean, plausible, entirely wrong pass.
  3. F-7 — source diversity in build-proof.ts. Pure code, no live run.

DO NOT:
  - Do not remove the templateInstantiated guard in output-guards.ts, and do not touch the
    ~4% proof rate. Both are CORRECT. Removing either puts fake citations in front of users.
  - Do not propose reconnecting the deploy. OFF, deliberately, owner-confirmed 2026-08-13.
  - Do not use "nobody uses it yet" as a reason not to build. Owner ruling.
  - Do not backfill funnel_events.origin. NULL is the honest value.
  - Do not delete the 9 card pickers in components/app/cards/. /settings mounts them. LIVE.

💰 Do not walk /welcome with a real handle. The calibrate stage autoStarts a ~128s Apify
scrape on a $5/mo capped account that dev shares with prod. Use
scripts/probe-wait-questions.mjs — it reaches the wait with no scrape and no DB write.

VERIFY IN A BROWSER on a PROD build, not dev, and not the suite. Recipe: handoff §6.
```

---

## 1. 🔴 MEMORY THAT COULD NOT BE SAVED — needs a session started in `~/virtuna-v1.1`

**No memory was written this session.** The path guard is keyed to the SESSION's worktree root, so
every write to `~/.claude/projects/.../memory/` fails from here and `cd`-ing to trunk does not
satisfy it. Everything below is the memory that should exist, written here instead.

**A. Correct `in-thread-chat-audit-lane.md` — five stale claims.** Full work order with evidence in
`HANDOFF-2026-08-15-three-orphans.md` §5b. The headline: it still calls the exemplar defect *"the
biggest thing still broken"* when **#482 fixed it unconditionally on 2026-08-12, 43% → 0%**. That
bullet cost a session. Also stale: session 7's thread context reads "Not merged" (it merged in
#475), the profile-interview owner question is closed by #502, and the deploy framing.

**B. Update `MEMORY.md:102`** — the lane index still says "session 13" and points at
`NEXT-SESSION-2026-08-14.md`. Now session 14, and this file.

**C. `profile-columns-are-mostly-empty.md` needs its CAUSE.** Its lesson — *count coverage in the DB
before building any grounding change* — is still exactly right and worth keeping. What it lacks is
why the profile was empty: **the interview could not be opened**, not that creators declined.
`/analyze` became a redirect on 2026-07-18 and took the only mount with it. `WaitQuestions` (#502)
replaced it.

**D. A new memory worth having, if any is:**

> **An inherited claim needs `git log --all --grep`, not re-derivation.** Re-deriving by hand
> confirms what is still broken and is structurally blind to what someone else already fixed. Two
> claims failed this way in one session — F-4 and the exemplar defect. Both had a fix commit whose
> message named them. **The strongest form: a PR that ships a FIX and the DOCUMENT DESCRIBING THE
> BUG in the same commit leaves a document that was false at merge** (#491 did exactly this).

---

## 2. Flag state, verified in code 2026-08-14

The convention: `!== "false"` means **default ON**; `=== "true"` means **default OFF / dark**.

| flag | state | what it does |
|---|---|---|
| `CHAT_AGENT_DISPATCH` | 🟢 ON | chat runs the tools — the lane's whole premise |
| `ENGINE_COUNT_HINT` | 🟢 ON | injects a count. **The single strongest lever found here** — 17% → 80%, nine pushbacks to zero |
| `COMPOSED_CARDS` | 🟢 ON | **flipped 2026-08-14 (#503)**, owner ruling |
| `ENGINE_CHAT_CARDS_ON_SCREEN` · `ENGINE_COMPARE_HINT` · `GROUNDING_CHAT_TOOL` | 🟢 ON | settled |
| **`ENGINE_GEN_CONVERSATION`** | 🟢 **ON** | **the generators seeing the conversation.** Merged dark in #475 (`d81ce44e`, 2026-08-10); **flipped to `!== "false"` 2026-08-15, owner ruling.** ⚠️ Shipped WITHOUT the live A/B its own comment promised — never measured. First flag to suspect if quality regresses; `=false` is the kill switch |
| `ENGINE_GUESS_PIN` | ⚫ DARK | ~100% dispatch, but **~3.4% would run something unasked-for** — and a wrong run bills the creator. The fallback, never the first choice |
| `ENGINE_REPEAT_ASK_PIN` | ⚫ DARK | ask twice → run again. The model otherwise narrates delivery and runs nothing |
| `ENGINE_PROSE_CALL_PIN` | ⚫ DARK | the model TYPES the tool call as visible text instead of making it. 6 of 26 — it did not get worse, the count fix stopped masking it |
| `NEXT_PUBLIC_ENGINE_ONE_BRAIN` | ⚫ DARK | Stage A/B (#461) |

---

## 3. The one thing to get right

**Before believing an absent signal, prove the path that produces it can run.**

Four times last session the answer was *"the code that would emit this cannot execute in these
conditions"*, and zero times was it *"the thing didn't happen"*. It applies to your own instruments
too — the session's single probe FAIL was the probe's own request-pairing bug, reported against a
save the UI had already confirmed succeeded.

**Corollary that cost the most:** *"unreachable" is a property of a MOUNT CHAIN, not of a file.* Two
surfaces can import the same component and only one be dead. There was a ruling to delete seven card
pickers; nine of them turned out to be live on `/settings`.

**And its mirror image:** three separate defects in this lane were invisible only because a bigger
defect stood in front of them (the prose-call bug behind the dispatch bug; F-7 behind the absent
proof). Fixing the loud one surfaces the quiet one. Expect it rather than re-diagnosing it.

---

## 4. Known-good — do not re-litigate

- The 3-question block, the `duringWait` slot, and the server-side `profile_interview_seen_at`
  stamp — verified 12/12 on a prod build with the database confirmed. Handoff §0.
- `checkout_open` is **not** an unreachable event, despite an earlier handoff saying so. Three are
  unreachable, not four — it also fires from `/go/page.tsx` and `checkout-modal.tsx`, so its zero is
  real and means the money screen has never been opened.
- The funnel sink **is** wired (`funnel-provider.tsx`). The old "no sink yet" header was stale.
- The 9 card pickers are LIVE on `/settings`. Every `creator_profiles` column and row is intact.

## 5. Loose ends, flagged and deliberately not taken

- ~~`text-foreground-tertiary` **is not a token** — the third tier is `foreground-muted`.
  `extension-card.tsx` and `upgrade-prompt.tsx` both style with it.~~ 🔴 **FALSE, corrected
  2026-08-15.** The token genuinely does not exist, but nothing styles with it: the string occurs
  once repo-wide, inside a JSDoc `@example` comment at `extension-card.tsx:79`, and
  `upgrade-prompt.tsx` never contained it. Nothing to fix. See `HANDOFF-2026-08-15-three-orphans.md` §5.
- `deriveSeedPrompts` (`lib/chat/seed-prompts.ts`) is orphaned now `CommandBar` is gone. Pure
  function with its own test; left in place rather than widening a deletion past its ruling.
- The sidebar's pin/rename/delete are 30×44, not 44×44. Three 44px hit areas 2px apart would overlap
  by 20px and the later sibling would win the tap — worse than small. The real fix is a `⋯` menu,
  which is a design call.
- Four F-rows have never been measured at all — F-3, F-8, F-11, F-12. Each needs one live run.
