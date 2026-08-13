# Next session — copy-paste brief (written 2026-08-13)

**Lane:** `lane/in-thread-chat` · worktree `~/virtuna-in-thread-chat`
**Main at handoff:** `c9ec3fa3`. Branch == main, working tree clean, nothing half-finished.
**Merged this session:** #495 (four UI fixes) · #497 (funnel origin + the calibration bracket).

---

## ▶️ PASTE THIS TO START

```
Read docs/NEXT-SESSION-2026-08-15.md, then docs/HANDOFF-2026-08-14-ui-fixes-and-the-funnel.md.

Repo ~/virtuna-in-thread-chat, branch lane/in-thread-chat, main at c9ec3fa3. tsc + build +
6399 tests all green, working tree clean.

CONTEXT IN ONE LINE: every "user" number in the older docs is a test account or me — no
external person has ever had an account. That makes those numbers unusable as evidence; it
is NOT an argument against building. The product is unlaunched, which is normal.

ONE thing needs a ruling from me before you write code. Ask me, then act:

  THE THREE ORPHANS. ProfileInterviewModal, ContentForm/CommandBar, and the /go walkthrough
  beats are live code that no route mounts. Mount them or delete them. Start with the
  interview — it is the source of the creator-profile columns the grounding lane assumes
  creators declined to fill in. They were never asked.

DO NOT:
  - Do not remove the templateInstantiated guard in output-guards.ts. It catches the model
    lying about its sources. Removing it puts fake citations back in front of users.
  - Do not propose reconnecting the deploy. It is OFF, deliberately, owner-confirmed
    2026-08-13. Not a code problem, not your task.
  - Do not use "nobody uses it yet" as a reason not to build something. Owner ruling, same
    day. Use it only to stop someone quoting probe traffic as user evidence.
  - Do not backfill funnel_events.origin on old rows. NULL is the honest value.

VERIFY IN A BROWSER on a PROD build, not dev, and not the suite. Recipe: handoff §7.
```

---

## 1. What this session did

| | |
|---|---|
| **#495** `a9d1f5c2` | The four measured UI defects. `headings 0 → 8` · tap targets `84 → 4` residual · both fades verified in-browser. **39 of the 84 were invisible-but-tappable buttons, the rightmost `Delete thread`** — that was the real bug, not the size. |
| **#497** `c9ec3fa3` | `funnel_events.origin` + `.path` (server-derived), and `handle_submit`/`calibrate_done` — declared since the funnel was designed, emitted from nowhere until now. |

---

## 2. 🔴 THE ONE THING TO GET RIGHT

**Every "user" number in the older docs is a test account or the owner. Stop quoting them as
evidence about creators — and do NOT read that as "don't build".**

⚠️ **A correction to how this session first framed it.** I originally wrote this section as *"stop
optimising a product nobody has reached"* and told the next session to fix the deploy. The owner
ruled on both the same day (`NEXT-SESSION-2026-08-14-remix.md`): the deploy is off **deliberately**,
and *"'nobody uses it yet' is NOT an argument against building — the product is unlaunched; that is
the normal state of unshipped software."* The measurements below are unchanged and still worth
having. The prescription I drew from them was wrong, and this is the corrected version: these
numbers kill **claims**, not **work**.

```
auth.users             123 rows
  · 111 anonymous      the designed no-account entry (/go's CTA mints a session)
  ·  12 with an email  →  9 test/staff  ·  3 the OWNER'S own addresses
                          ────────────────────────────────────────────
                          EXTERNAL SIGNUPS, ALL TIME:  0

checkout_open   0 events, ever      ← call site reachable, so this zero is real
checkout_paid   0 events, ever      ← same
```

The brief's old "18 signups / 3 opened onboarding / 1 generated" each counted something else:
18 = `creator_profiles` rows, 3 = `profile_interview_seen_at` (last stamped **2026-05-31**, by two
test accounts and the owner), 1 = one card on an anonymous session.

And the 111 anonymous rows are mostly not people either: 43 message-senders produced **8 distinct
opening lines**, the top three byte-identical, one a literal `@example` placeholder URL.

🔑 **The method rule this bought.** A count is not a rate, and a rate over synthetic accounts is
not a rate at all. Before writing "measured": group by user **and** check whether the distinct
INPUTS outnumber the rows. Eight distinct strings across 43 accounts is one script, not 43 users.
This generalises 2026-08-13's `group by threads.user_id` from *whose rows* to *whether they are
anyone's*.

---

## 3. Where to start, in order

1. 🔴 **Get the owner's ruling on the three orphans** (handoff §2). Each is a permanent 0 in a
   metric someone will eventually read as a preference. The interview is the expensive one.
2. 🔴 **Deploy is OFF, owner-confirmed 2026-08-13, and that is a CONSTRAINT — not a task.** Do not
   propose reconnecting it. What it forbids: never write a plan whose success criterion is
   "watch it in production". Everything must be verifiable by probe, by test, or by a browser
   against a local **prod build**. `scripts/probe-tap-targets.mjs` and
   `scripts/probe-beat-frames.ts` are the model — real bytes, PASS/FAIL, seconds, free.
3. **The funnel instrumentation (#497) is therefore a deposit, not a dashboard.** It will read
   nothing until launch, and that is fine — it is the expensive-to-retrofit half, and the call
   sites are now correct. Do not go looking for numbers in it.
4. **Still open from before, unchanged, and worth building:** F-1 (pack renders twice, ~8%) · the
   madlib instantiation rate · Card 9's two-way door. All in `HANDOFF-2026-08-13-audit-rewalk.md`.
5. **Cosmetic residual:** the sidebar's pin/rename/delete are **30×44, not 44×44**. Three 44px hit
   areas 2px apart would overlap by 20px and the later sibling wins the tap — worse than small.
   The real fix is a `⋯` menu; that is a design call, not a CSS one.

---

## 4. ⚠️ TRAPS THIS SESSION PAID FOR

Every one produced a confident wrong answer first.

| the reading | why it was wrong |
|---|---|
| `backgroundImage: "none"` ⇒ F-13 unfixed | the fade is a **mask**. The probe was reading a property the fix does not use, on a working surface |
| 84 sub-40px targets ⇒ 84 things to enlarge | 58 were in a **closed off-canvas drawer**, and 39 of those were **invisible**. Different bug |
| a `.tap-44` element still measures 47×18 ⇒ unfixed | a `::after` halo never changes the host's rect. **Hit-test, don't measure boxes** |
| 15 controls fail the 44px hit test | 11 were **`border-radius`** — the square's *corners* land outside a rounded shape. Sample **edge midpoints** |
| 89 of 92 controls fail | `elementFromPoint` only answers for **on-screen pixels**. An off-canvas drawer is not a failure, it is unmeasured |
| `demo_fix_open: 0` ⇒ 23 people bounced at beat 1 | those events are emitted only from components **no route mounts**. Unreachable ≠ unchosen |
| `first_card_shown: 0` ⇒ no card was ever shown | it fires only from the activation CTA. Hundreds of cards exist |

🔑 **The generalisation: an absent signal has at least two causes, and "nobody did it" is the
less likely one.** Before reading a 0 as behaviour, prove the code path that emits it is reachable.

**And two test-shaped versions of the same thing.** Both guards I broke were asserting a *proxy*:
"no `h1`" standing in for "no greeting", and `textContent` indices standing in for layout order. A
legitimate change to a *different* thing broke both. Neither was loosened — they now assert what
they name. When you add a guard, also **check it is not vacuous**: I reverted the fix to confirm
the new `calibrate_done` test actually fails without it.

---

## 5. Verification recipe (used today, works)

```bash
npm run build && npm run start -- --port 3016      # PROD build; dev overlays fake UI bugs
node scripts/mint-auth-state.mjs      http://localhost:3016
node scripts/probe-audit-rewalk.mjs   http://localhost:3016 <threadId>   # both viewports, native
node scripts/probe-tap-targets.mjs    http://localhost:3016 <threadId>   # hit-tested, not boxes
```

⚠️ In **dev**, the Next.js indicator and the mock-panel ⚙ sit exactly over the composer's attach
button and read as a covered tap target. Audit on the prod build.
⚠️ `.scratch/auth-state.json` is a REAL session for a REAL prod account. Gitignored; keep it so.
⚠️ `BILLING_ENFORCE_QUOTA` is true and dev shares prod's Supabase. **Driving /welcome to submit a
handle starts a real Apify scrape on a $5/mo capped account** — the calibrate stage `autoStart`s.
Test that path with the unit tests in `connect-step.test.tsx`, not a browser walk.

---

## 6. Housekeeping

- **`funnel_events` DDL is applied to prod already**, via the SQL-editor path — `supabase db push`
  is unsafe here (ledger drift). The migration file is the record, not the mechanism.
- **Never backfill `funnel_events.origin`.** NULL means "recorded before the column existed, origin
  unknown". Filter those rows out of traffic claims; do not assume they were production.
- Read the calibration rate as `calibrate_done{calibrated:true} / handle_submit`. The event fires
  on failed scrapes too, by design.
- 🔴 The lane memory index is still STALE (it says "session 12"). The worktree path guard blocks
  writing to `~/.claude/projects/.../memory/` from here; it can only be fixed from trunk. **The
  merged handoffs are authoritative.**
- A trunk session shipped the remix card rework (#494, #496) today — see
  `NEXT-SESSION-2026-08-14-remix.md`. It touches `remix-card-block.tsx`, which this lane also
  edited; #497 merged cleanly, but check that file first if you touch it.
